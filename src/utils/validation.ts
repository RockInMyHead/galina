import { FormErrors, LoginFormData, RegisterFormData, MIN_PASSWORD_LENGTH, MIN_NAME_LENGTH } from '@/types'

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validatePassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH
}

export function validateName(name: string): boolean {
  return name.trim().length >= MIN_NAME_LENGTH
}

export function validateLoginForm(values: LoginFormData): FormErrors<LoginFormData> {
  const errors: FormErrors<LoginFormData> = {}

  if (!values.email.trim()) {
    errors.email = 'Email обязателен'
  } else if (!validateEmail(values.email)) {
    errors.email = 'Введите корректный email'
  }

  if (!values.password) {
    errors.password = 'Пароль обязателен'
  } else if (!validatePassword(values.password)) {
    errors.password = `Пароль должен содержать минимум ${MIN_PASSWORD_LENGTH} символов`
  }

  return errors
}

export function validateRegisterForm(values: RegisterFormData): FormErrors<RegisterFormData> {
  const errors: FormErrors<RegisterFormData> = {}

  if (!values.name.trim()) {
    errors.name = 'Имя обязательно'
  } else if (!validateName(values.name)) {
    errors.name = `Имя должно содержать минимум ${MIN_NAME_LENGTH} символа`
  }

  if (!values.email.trim()) {
    errors.email = 'Email обязателен'
  } else if (!validateEmail(values.email)) {
    errors.email = 'Введите корректный email'
  }

  if (!values.password) {
    errors.password = 'Пароль обязателен'
  } else if (!validatePassword(values.password)) {
    errors.password = `Пароль должен содержать минимум ${MIN_PASSWORD_LENGTH} символов`
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Подтверждение пароля обязательно'
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = 'Пароли не совпадают'
  }

  return errors
}
