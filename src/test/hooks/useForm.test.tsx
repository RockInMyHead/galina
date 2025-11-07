import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useForm } from '@/hooks/useForm'

interface TestFormData {
  name: string
  email: string
}

describe('useForm hook', () => {
  const initialValues: TestFormData = {
    name: '',
    email: ''
  }

  it('should initialize with correct values', () => {
    const { result } = renderHook(() => useForm<TestFormData>({
      initialValues,
      validate: () => ({}),
      onSubmit: vi.fn()
    }))

    expect(result.current.values).toEqual(initialValues)
    expect(result.current.errors).toEqual({})
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.isDirty).toBe(false)
  })

  it('should update field value', () => {
    const { result } = renderHook(() => useForm<TestFormData>({
      initialValues,
      validate: () => ({}),
      onSubmit: vi.fn()
    }))

    act(() => {
      result.current.updateField('name')('John Doe')
    })

    expect(result.current.values.name).toBe('John Doe')
    expect(result.current.isDirty).toBe(true)
  })

  it('should validate form and return errors', () => {
    const validate = (values: TestFormData) => {
      const errors: Record<string, string> = {}
      if (!values.name.trim()) {
        errors.name = 'Name is required'
      }
      return errors
    }

    const { result } = renderHook(() => useForm<TestFormData>({
      initialValues,
      validate,
      onSubmit: vi.fn()
    }))

    act(() => {
      const isValid = result.current.validateForm()
      expect(isValid).toBe(false)
    })

    expect(result.current.errors.name).toBe('Name is required')
  })

  it('should call onSubmit when form is valid', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const validate = () => ({})

    const { result } = renderHook(() => useForm<TestFormData>({
      initialValues: { name: 'John', email: 'john@example.com' },
      validate,
      onSubmit
    }))

    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(onSubmit).toHaveBeenCalledWith({ name: 'John', email: 'john@example.com' })
    expect(result.current.isSubmitting).toBe(false)
  })

  it('should set submitting state during form submission', async () => {
    const onSubmit = vi.fn().mockImplementation(() =>
      new Promise(resolve => setTimeout(resolve, 100))
    )

    const { result } = renderHook(() => useForm<TestFormData>({
      initialValues,
      validate: () => ({}),
      onSubmit
    }))

    act(() => {
      result.current.handleSubmit()
    })

    expect(result.current.isSubmitting).toBe(true)

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150))
    })

    expect(result.current.isSubmitting).toBe(false)
  })

  it('should reset form', () => {
    const { result } = renderHook(() => useForm<TestFormData>({
      initialValues,
      validate: () => ({}),
      onSubmit: vi.fn()
    }))

    act(() => {
      result.current.updateField('name')('John')
      result.current.setError('general', 'Test error')
    })

    expect(result.current.values.name).toBe('John')
    expect(result.current.isDirty).toBe(true)
    expect(result.current.errors.general).toBe('Test error')

    act(() => {
      result.current.resetForm()
    })

    expect(result.current.values).toEqual(initialValues)
    expect(result.current.errors).toEqual({})
    expect(result.current.isDirty).toBe(false)
  })

  it('should clear errors', () => {
    const { result } = renderHook(() => useForm<TestFormData>({
      initialValues,
      validate: () => ({}),
      onSubmit: vi.fn()
    }))

    act(() => {
      result.current.setError('general', 'Test error')
      result.current.setError('name', 'Name error')
    })

    expect(result.current.errors.general).toBe('Test error')
    expect(result.current.errors.name).toBe('Name error')

    act(() => {
      result.current.clearErrors()
    })

    expect(result.current.errors).toEqual({})
  })
})
