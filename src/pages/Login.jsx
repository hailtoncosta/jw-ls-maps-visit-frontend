import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MapPin, Loader2, LogIn, Eye, EyeOff, Mail, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { api } from "@/api/apiClient";

export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const isReset = location.pathname === "/reset-password";
  const [token] = useState(() => new URLSearchParams(window.location.search).get("token"));
  useEffect(() => {
    if (isReset && token) window.history.replaceState(window.history.state, "", "/reset-password");
  }, [isReset, token]);
  const [forgot, setForgot] = useState(false);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (isReset && password !== confirmation) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      if (isReset) {
        await api.auth.resetPassword(token, password);
        toast.success("Senha alterada. Entre com a nova senha.");
        navigate("/login", { replace: true });
      } else if (forgot) {
        await api.auth.requestPasswordReset(email.trim());
        setSent(true);
      } else {
        await api.auth.login(email.trim(), password);
        window.location.href = "/";
      }
    } catch (error) {
      toast.error(error.message || "Não foi possível concluir a solicitação.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <MapPin className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">LS Maps Visit</h1>
          <p className="text-muted-foreground mt-2">
            {isReset ? "Definir nova senha" : forgot ? "Recuperar senha" : "Acesse sua conta"}
          </p>
        </div>

        {isReset && !token ? (
          <p className="text-sm text-center text-destructive mb-4">Link de recuperação inválido. Solicite um novo link.</p>
        ) : sent && forgot && !isReset ? (
          <p className="text-sm text-center mb-5" role="status">
            Se o e-mail estiver cadastrado, você receberá um link para definir uma nova senha. Verifique também a caixa de spam.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            {!isReset && (
              <div className="space-y-2">
                <Label htmlFor="login-email">E-mail</Label>
                <Input id="login-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)}
                  required autoComplete="username" />
              </div>
            )}
            {(!forgot || isReset) && (
              <div className="space-y-2">
                <Label htmlFor="login-password">{isReset ? "Nova senha" : "Senha"}</Label>
                <div className="relative">
                  <Input id="login-password" type={showPassword ? "text" : "password"} value={password}
                    onChange={(event) => setPassword(event.target.value)} required minLength={isReset ? 8 : undefined}
                    maxLength={isReset ? 128 : undefined} autoComplete={isReset ? "new-password" : "current-password"} className="pr-11" />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-r-md"
                    aria-label={showPassword ? "Ocultar senha" : "Exibir senha"} aria-pressed={showPassword}>
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            )}
            {isReset && (
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirme a nova senha</Label>
                <Input id="confirm-password" type={showPassword ? "text" : "password"} value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)} required minLength={8} maxLength={128}
                  autoComplete="new-password" />
              </div>
            )}
            <Button className="w-full gap-2" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isReset ? <KeyRound className="h-4 w-4" /> : forgot ? <Mail className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
              {isReset ? "Salvar nova senha" : forgot ? "Enviar link de recuperação" : "Entrar"}
            </Button>
          </form>
        )}

        <div className="text-center mt-5">
          {isReset ? (
            <Link to="/login" className="text-sm text-primary hover:underline">Voltar ao login</Link>
          ) : (
            <button type="button" className="text-sm text-primary hover:underline" onClick={() => { setForgot(!forgot); setSent(false); }}>
              {forgot ? "Voltar ao login" : "Esqueceu sua senha?"}
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
