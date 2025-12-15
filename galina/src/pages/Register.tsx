import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Header from '@/components/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Eye, EyeOff, Lock, Mail, User } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useForm } from '@/hooks/useForm'
import { RegisterFormData } from '@/types'
import { validateRegisterForm } from '@/utils/validation'

const Register = () => {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

      const {
        values,
        errors,
        isSubmitting,
        updateField,
        handleSubmit: handleFormSubmit,
        setError
      } = useForm<RegisterFormData>({
    initialValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    },
    validate: validateRegisterForm,
    onSubmit: async (formValues) => {
      const success = await register(formValues.email, formValues.password, formValues.name)
      if (success) {
        navigate('/dashboard')
      } else {
        setError('general', 'Ошибка регистрации. Возможно, email уже используется.')
      }
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await handleFormSubmit()
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Card className="border-border/50 shadow-elegant">
            <CardHeader className="text-center space-y-2">
              <div className="flex justify-center mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-6 w-6" />
                </div>
              </div>
              <CardTitle className="text-2xl">Регистрация</CardTitle>
              <CardDescription>
                Создайте аккаунт для доступа к системе
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {errors.general && (
                <Alert variant="destructive">
                  <AlertDescription>{errors.general}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Имя</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="Ваше имя"
                      value={values.name}
                      onChange={(e) => updateField('name')(e.target.value)}
                      className={`pl-10 ${errors.name ? 'border-destructive' : ''}`}
                      aria-invalid={!!errors.name}
                      aria-describedby={errors.name ? 'name-error' : undefined}
                      required
                    />
                  </div>
                  {errors.name && (
                    <p id="name-error" className="text-sm text-destructive">
                      {errors.name}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="your@email.com"
                      value={values.email}
                      onChange={(e) => updateField('email')(e.target.value)}
                      className={`pl-10 ${errors.email ? 'border-destructive' : ''}`}
                      aria-invalid={!!errors.email}
                      aria-describedby={errors.email ? 'email-error' : undefined}
                      required
                    />
                  </div>
                  {errors.email && (
                    <p id="email-error" className="text-sm text-destructive">
                      {errors.email}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Пароль</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={values.password}
                      onChange={(e) => updateField('password')(e.target.value)}
                      className={`pl-10 pr-10 ${errors.password ? 'border-destructive' : ''}`}
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? 'password-error' : undefined}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p id="password-error" className="text-sm text-destructive">
                      {errors.password}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={values.confirmPassword}
                      onChange={(e) => updateField('confirmPassword')(e.target.value)}
                      className={`pl-10 pr-10 ${errors.confirmPassword ? 'border-destructive' : ''}`}
                      aria-invalid={!!errors.confirmPassword}
                      aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p id="confirmPassword-error" className="text-sm text-destructive">
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full shadow-elegant"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Регистрация...' : 'Зарегистрироваться'}
                </Button>
              </form>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Уже есть аккаунт?{' '}
                  <Link to="/login" className="text-primary hover:underline">
                    Войти
                  </Link>
                </p>
              </div>
        </CardContent>
      </Card>
    </div>
  </main>
</div>
  );
};

export default Register;
