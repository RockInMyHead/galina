import { describe, it, expect } from 'vitest'
import {
  validateEmail,
  validatePassword,
  validateName,
  validateLoginForm,
  validateRegisterForm
} from '@/utils/validation'
import { LoginFormData, RegisterFormData } from '@/types'

describe('Validation Utils', () => {
  describe('validateEmail', () => {
    it('should return true for valid email', () => {
      expect(validateEmail('test@example.com')).toBe(true)
      expect(validateEmail('user.name+tag@domain.co.uk')).toBe(true)
    })

    it('should return false for invalid email', () => {
      expect(validateEmail('invalid-email')).toBe(false)
      expect(validateEmail('test@')).toBe(false)
      expect(validateEmail('@example.com')).toBe(false)
      expect(validateEmail('')).toBe(false)
    })
  })

  describe('validatePassword', () => {
    it('should return true for valid password', () => {
      expect(validatePassword('password123')).toBe(true)
      expect(validatePassword('123456')).toBe(true)
    })

    it('should return false for invalid password', () => {
      expect(validatePassword('12345')).toBe(false)
      expect(validatePassword('')).toBe(false)
      expect(validatePassword('123')).toBe(false)
    })
  })

  describe('validateName', () => {
    it('should return true for valid name', () => {
      expect(validateName('John')).toBe(true)
      expect(validateName('Анна')).toBe(true)
      expect(validateName('AB')).toBe(true)
    })

    it('should return false for invalid name', () => {
      expect(validateName('A')).toBe(false)
      expect(validateName('')).toBe(false)
      expect(validateName(' ')).toBe(false)
    })
  })

  describe('validateLoginForm', () => {
    it('should return no errors for valid data', () => {
      const validData: LoginFormData = {
        email: 'test@example.com',
        password: 'password123'
      }

      const errors = validateLoginForm(validData)
      expect(errors).toEqual({})
    })

    it('should return email error for invalid email', () => {
      const invalidData: LoginFormData = {
        email: 'invalid-email',
        password: 'password123'
      }

      const errors = validateLoginForm(invalidData)
      expect(errors.email).toBe('Введите корректный email')
    })

    it('should return password error for short password', () => {
      const invalidData: LoginFormData = {
        email: 'test@example.com',
        password: '123'
      }

      const errors = validateLoginForm(invalidData)
      expect(errors.password).toBe('Пароль должен содержать минимум 6 символов')
    })

    it('should return multiple errors', () => {
      const invalidData: LoginFormData = {
        email: 'invalid',
        password: '123'
      }

      const errors = validateLoginForm(invalidData)
      expect(errors.email).toBeDefined()
      expect(errors.password).toBeDefined()
    })
  })

  describe('validateRegisterForm', () => {
    it('should return no errors for valid data', () => {
      const validData: RegisterFormData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        confirmPassword: 'password123'
      }

      const errors = validateRegisterForm(validData)
      expect(errors).toEqual({})
    })

    it('should return name error for invalid name', () => {
      const invalidData: RegisterFormData = {
        name: 'A',
        email: 'john@example.com',
        password: 'password123',
        confirmPassword: 'password123'
      }

      const errors = validateRegisterForm(invalidData)
      expect(errors.name).toBe('Имя должно содержать минимум 2 символа')
    })

    it('should return password mismatch error', () => {
      const invalidData: RegisterFormData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        confirmPassword: 'different123'
      }

      const errors = validateRegisterForm(invalidData)
      expect(errors.confirmPassword).toBe('Пароли не совпадают')
    })
  })
})
