import { useState, useRef, useEffect, useCallback } from 'react';
import { API_CONFIG } from '@/config/constants';

const API_URL = API_CONFIG.BASE_URL;

interface UseLawyerTTSProps {
  token?: string | null;
  onPlaybackStatusChange?: (isPlaying: boolean) => void;
}

export const useLawyerTTS = ({ token, onPlaybackStatusChange }: UseLawyerTTSProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Refs to maintain state without re-renders
  const audioContextRef = useRef<AudioContext | null>(null);
  const speakerGainRef = useRef<GainNode | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingAudioRef = useRef(false);
  const isSynthesizingRef = useRef(false);
  const currentSpeechSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const generationIdRef = useRef(0);
  const lastProcessedTextRef = useRef<string>('');
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Synchronize ref state with React state for UI consumers
  const updatePlayingState = (playing: boolean) => {
    isPlayingAudioRef.current = playing;
    setIsPlaying(playing);
    onPlaybackStatusChange?.(playing || isSynthesizingRef.current);
  };

  const updateSynthesizingState = (synthesizing: boolean) => {
    isSynthesizingRef.current = synthesizing;
    setIsSynthesizing(synthesizing);
    onPlaybackStatusChange?.(isPlayingAudioRef.current || synthesizing);
  };

  const createAudioContext = () => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }
    return audioContextRef.current;
  };

  const initializeAudioContext = async () => {
    const audioContext = createAudioContext();

    if (!speakerGainRef.current && audioContext) {
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 1;
      gainNode.connect(audioContext.destination);
      speakerGainRef.current = gainNode;
    }

    if (audioContext && audioContext.state === 'suspended') {
      try {
        await audioContext.resume();
      } catch (error) {
        console.warn("[LawyerTTS] Failed to resume AudioContext:", error);
      }
    }
    return audioContext;
  };

  const stop = useCallback(() => {
    const newGenerationId = generationIdRef.current + 1;
    generationIdRef.current = newGenerationId;

    // Clear queue
    audioQueueRef.current = [];

    // Stop current audio element
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current.src = '';
      } catch (error) {
        console.warn("[LawyerTTS] Error stopping audio element:", error);
      }
      currentAudioRef.current = null;
    }

    // Stop current source
    if (currentSpeechSourceRef.current) {
      try {
        currentSpeechSourceRef.current.stop();
        currentSpeechSourceRef.current.disconnect();
      } catch (error) {
        console.warn("[LawyerTTS] Error stopping speech source:", error);
      }
      currentSpeechSourceRef.current = null;
    }

    updatePlayingState(false);
    updateSynthesizingState(false);

    console.log(`[LawyerTTS] Speech stopped (gen: ${newGenerationId})`);
  }, []);

  // Reset processed text tracking when stopping
  useEffect(() => {
    if (!isPlaying && !isSynthesizing) {
      lastProcessedTextRef.current = '';
    }
  }, [isPlaying, isSynthesizing]);

  // Function to explicitly reset deduplication for new user input
  const resetDeduplication = useCallback(() => {
    console.log(`[LawyerTTS] Resetting deduplication for new user input`);
    lastProcessedTextRef.current = '';
  }, []);

  const speak = useCallback(async (text: string) => {
    const callId = Date.now();
    console.log(`[LawyerTTS] speak called (ID: ${callId}) with text: "${text?.substring(0, 50)}..."`);

    // Prevent duplicate TTS processing
    const trimmedText = text?.trim() || '';
    if (!trimmedText) return;

    // Check for exact duplicate
    const lastProcessed = lastProcessedTextRef.current;
    if (lastProcessed === trimmedText) {
      console.log(`[LawyerTTS] Skipping exact duplicate text (ID: ${callId})`);
      return;
    }

    console.log(`[LawyerTTS] Processing new text (ID: ${callId})`);
    lastProcessedTextRef.current = trimmedText;

    const myGenId = generationIdRef.current;
    updateSynthesizingState(true);

    try {
      console.log(`[LawyerTTS] Calling TTS API...`);
      
      const response = await fetch(`${API_URL}/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          text: trimmedText,
          voice: 'nova', // Female voice for Galina
          model: 'tts-1-hd',
          speed: 0.95
        })
      });

      if (generationIdRef.current !== myGenId) {
        console.log(`[LawyerTTS] Generation interrupted, stopping (ID: ${callId})`);
        return;
      }

      if (!response.ok) {
        throw new Error(`TTS API error: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;

      updateSynthesizingState(false);
      updatePlayingState(true);

      audio.onplay = () => {
        console.log(`[LawyerTTS] Audio playback started (ID: ${callId})`);
      };

      audio.onended = () => {
        console.log(`[LawyerTTS] Audio playback ended (ID: ${callId})`);
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        updatePlayingState(false);
      };

      audio.onerror = (event) => {
        console.error(`[LawyerTTS] Audio playback error (ID: ${callId}):`, event);
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        updatePlayingState(false);
      };

      if (generationIdRef.current !== myGenId) {
        console.log(`[LawyerTTS] Generation interrupted before play (ID: ${callId})`);
        return;
      }

      await audio.play();
      console.log(`[LawyerTTS] Audio playing (ID: ${callId})`);

    } catch (error) {
      console.error("[LawyerTTS] Error synthesizing speech:", error);
      updateSynthesizingState(false);
      updatePlayingState(false);
    }
  }, [token]);

  const setSpeakerVolume = (on: boolean) => {
    if (speakerGainRef.current && audioContextRef.current) {
      speakerGainRef.current.gain.setValueAtTime(on ? 1 : 0, audioContextRef.current.currentTime);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    speak,
    stop,
    setSpeakerVolume,
    resetDeduplication,
    isPlaying,
    isSynthesizing,
    isPlayingRef: isPlayingAudioRef,
    isSynthesizingRef,
    audioContextRef
  };
};


