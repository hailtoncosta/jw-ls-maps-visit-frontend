// Navegação de retorno inteligente: volta no histórico do navegador quando
// existe uma tela anterior válida; caso contrário, vai para uma rota de
// fallback (evita sair do aplicativo). Usado pelos botões "Voltar" das telas
// internas e complementa o botão físico/gestual "Voltar" do Android, que já
// percorre o histórico via BrowserRouter.
export function goBack(navigate, fallback = "/") {
  if (window.history.length > 1) {
    navigate(-1);
  } else {
    navigate(fallback);
  }
}