import { useState, useCallback } from 'react'
import { FormErrors } from '@/types'

interface UseFormOptions<T> {
  initialValues: T
  validate?: (values: T) => FormErrors<T>
  onSubmit?: (values: T) => Promise<void> | void
}

export function useForm<T extends Record<string, any>>({
  initialValues,
  validate,
  onSubmit
}: UseFormOptions<T>) {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<FormErrors<T>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const updateField = useCallback((field: keyof T) => (value: any) => {
    setValues(prev => ({ ...prev, [field]: value }))
    setIsDirty(true)

    // Clear field-specific error when user starts typing
    if (errors[field as string]) {
      setErrors(prev => ({ ...prev, [field as string]: undefined }))
    }
  }, [errors])

  const setFieldValue = useCallback((field: keyof T, value: any) => {
    updateField(field)(value)
  }, [updateField])

  const validateForm = useCallback((): boolean => {
    if (!validate) return true

    const validationErrors = validate(values)
    setErrors(validationErrors)
    return Object.keys(validationErrors).length === 0
  }, [validate, values])

  const resetForm = useCallback(() => {
    setValues(initialValues)
    setErrors({})
    setIsDirty(false)
    setIsSubmitting(false)
  }, [initialValues])

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)
    try {
      await onSubmit?.(values)
    } catch (error) {
      console.error('Form submission error:', error)
      setErrors({ general: 'Произошла ошибка при отправке формы' })
    } finally {
      setIsSubmitting(false)
    }
  }, [validateForm, onSubmit, values])

  const clearErrors = useCallback(() => setErrors({}), [])

  const setError = useCallback((field: keyof T | 'general', message: string) => {
    setErrors(prev => ({ ...prev, [field]: message }))
  }, [])

  return {
    values,
    errors,
    isSubmitting,
    isDirty,
    updateField,
    setFieldValue,
    handleSubmit,
    validateForm,
    resetForm,
    clearErrors,
    setError
  }
}
