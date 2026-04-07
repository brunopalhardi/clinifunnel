Verifique se o deploy do CliniFunnel está funcionando corretamente:

1. Acesse https://clinifunnel.koaai.com.br/login via Playwright (browser_navigate)
2. Faça login com admin@clinifunnel.com / admin123 (browser_fill_form + browser_click)
3. Aguarde 3s e confirme redirect pro dashboard
4. Verifique erros de console (browser_console_messages level error)
5. Navegue pra /dashboard/settings — confirme que NÃO fica em "Carregando..."
6. Navegue pra /dashboard/campaigns — confirme que carrega
7. Tire screenshot final (browser_take_screenshot)
8. Reporte resultado: OK ou FALHOU com detalhes
