import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { userStorage } from "./utils/storageUtils";

// Initialize data synchronization service only if user is authenticated with a valid token
// Check for browser environment first
if (typeof window !== 'undefined') {
  const user = userStorage.get();
  const token = localStorage.getItem('galina-token');

  // Only start sync if both user data AND token exist
  // The actual token validation happens in AuthContext, so we just check presence here
  if (user && (user as any).id && token) {
    console.log('👤 User data and token found, starting data synchronization');
    // Delay the first sync to allow AuthContext to validate the token first
    setTimeout(async () => {
      try {
        // Import syncService only when needed and in browser environment
        const { syncService } = await import("./utils/syncService");
        // Re-check if token still exists after AuthContext validation
        const stillHasToken = localStorage.getItem('galina-token');
        if (stillHasToken) {
          syncService.startPeriodicSync();
        } else {
          console.log('👤 Token was invalidated, skipping sync');
        }
      } catch (error) {
        console.error('Failed to initialize sync service:', error);
      }
    }, 2000); // Wait 2 seconds for AuthContext to validate
  } else {
    console.log('👤 User not authenticated (missing user data or token), skipping data synchronization');
  }
}

createRoot(document.getElementById("root")!).render(<App />);
