import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Header from '@/components/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useForm } from '@/hooks/useForm'
import { LoginFormData } from '@/types'
import { validateLoginForm } from '@/utils/validation'

const Login = () => {
  const [showPassword, setShowPassword] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const {
    values,
    errors,
    isSubmitting,
    updateField,
    handleSubmit: handleFormSubmit,
    setError
  } = useForm<LoginFormData>({
    initialValues: {
      email: '',
      password: ''
    },
    validate: validateLoginForm,
    onSubmit: async (formValues) => {
      const success = await login(formValues.email, formValues.password)
      if (success) {
        navigate('/dashboard')
      } else {
        setError('general', 'Неверный email или пароль')
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
                  <Lock className="h-6 w-6" />
                </div>
              </div>
              <CardTitle className="text-2xl">Вход в личный кабинет</CardTitle>
              <CardDescription>
                Введите ваши учетные данные для доступа к системе
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
                  {(errors.general || errors.email || errors.password || errors.confirmPassword) && (
                    <Alert variant="destructive">
                      <AlertDescription>
                        {errors.general ||
                         [errors.email, errors.password, errors.confirmPassword].filter(Boolean).join('. ') ||
                         'Пожалуйста, исправьте ошибки в форме'}
                      </AlertDescription>
                    </Alert>
                  )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
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

                <Button
                  type="submit"
                  className="w-full shadow-elegant"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Вход...' : 'Войти'}
                </Button>
              </form>

              <div className="text-center space-y-4">
                <div className="text-sm text-muted-foreground">
                  Нет аккаунта?{' '}
                  <Link to="/register" className="text-primary hover:underline">
                    Зарегистрироваться
                  </Link>
                </div>

                <div className="text-sm text-muted-foreground">
                  <Link to="/forgot-password" className="text-primary hover:underline">
                    Забыли пароль?
                  </Link>
                </div>
              </div>

        </CardContent>
      </Card>
    </div>
  </main>
</div>
  );
};

export default Login;
