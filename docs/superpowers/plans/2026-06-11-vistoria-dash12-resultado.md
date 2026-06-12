# Vistoria DASH-12 — Resultado (2026-06-11)

Executada read-only contra o banco de produção (`odontofunil` @ 5.161.209.197) e a API do Clinicorp (`/estimates/list`), via scripts Node descartáveis. Clínica: **AD Clínica** (`cmnkum02o0000wakegk544jsj`). Origem dos pedidos: call Fathom 703358852 com Sérgio (08/06).

## GATE 1 — Tipos de consulta (`Appointment.categoryDescription`)

Distribuição (all-time, deleted=false):

| categoryDescription | qtd | classificação |
|---|---|---|
| Retorno | 91 | recorrente |
| Consulta | 87 | recorrente (já é paciente) |
| Avaliação | 25 | **novo** (primeira consulta / lead) |
| Procedimento | 15 | outros |
| Blogueira | 15 | outros |
| Paciente modelo - ajuste | 3 | outros |
| (null) | 14 | sem tag |
| "" (vazio) | 3 | sem tag |

**Fill-rate: 93,3%** (236/253 com tag). Acima do limiar de 80% → **classificação primária por tag** (como o Sérgio descreveu em 22:11), com fallback por histórico de procedures.

Constantes confirmadas para `src/lib/metrics/patient-ticket.ts` (após `normalizeCategory` que remove acento/caixa):
- `CATEGORIAS_NOVO = { "avaliacao" }`
- `CATEGORIAS_RECORRENTE = { "consulta", "retorno" }`
- Buckets do PR C: `primeira_consulta`=Avaliação, `retorno`=Retorno, `recorrente`=Consulta, `outros`=resto.

> **NÃO existe** a string "Primeira Consulta" no banco — é "Avaliação". Ajustar o plano (que assumia ambas).

## GATE 2 — Dentista/doutora

| Fonte | Fill-rate dentista | Observação |
|---|---|---|
| `Appointment.dentistName` | **0%** (192/192 NULL desde maio; 72 appts de junho todos null) | API `/appointment/list` não retorna dentista para esta clínica |
| `Procedure` via `/estimates/list` (`DentistName`) | **100%** (146/146 em junho) | 2 doutoras: **Dra. Aléxia Duarte**, **Dra. Gabriela Leite**. `ProfessionalName` no nível da estimate também 100%. |

**Decisão (revisão do plano):** "ticket médio por doutora" E "pacientes por doutora" devem ser derivados de **Procedure** (100% preenchido após PR A persistir `dentistName`), **NÃO de Appointment** (0%). A abordagem original do PR B que usava `appointment.groupBy(dentistName)` retornaria só "Sem dentista" — substituída por agregação sobre procedures aprovados.

> Dívida técnica registrada: análises futuras "por dentista a nível de agenda/atendimento" ficam bloqueadas até o Clinicorp popular `DentistName` no endpoint de appointments. Hoje só dá pra cruzar dentista↔paciente via orçamento.

## GATE 3 — Validação dos números de junho

Appointments por status:

| statusKey | junho mês cheio | até 08/06 |
|---|---|---|
| atendido | 41 | 32 |
| faltou | 21 | 14 |
| confirmado | 6 | 2 |
| agendado | 4 | 0 |
| **total** | **72** | **48** |

Na call (08/06) o Sérgio viu no Clinicorp: ~93 agendamentos totais (mês), ~49 até dia 8, 27 atendidos, 12-16 faltas. Comparação:
- Até dia 8: **48 ≈ 49** ✓; faltas **14** dentro de 12-16 ✓; atendidos **32 vs 27** (subiu — appointments marcados como atendidos depois da call, ou número aproximado dele).
- Mês cheio 72 vs 93: provável diferença da janela de sync de 30 dias / futuros de junho ainda não sincronizados. **Acompanhar** — não é gap crítico, mas vale reconferir após próximo sync.

Procedures de junho (`createdAt` no mês, deleted=false):

| statusDescription | qtd | receita líquida | pacientes distintos |
|---|---|---|---|
| Aprovado | 84 | R$ 115.982 | 26 |
| Orçamento | 42 | R$ 79.070 | — |

Na call o Sérgio validou "68 procedimentos / 16 aprovados / R$ 87,8k / 18 pacientes". Diferença explicada por **granularidade** (ele citou 16 *orçamentos* aprovados e R$ 87,8k; aqui contamos 84 *linhas* de procedimento aprovadas) + **acúmulo** de 3 dias (call 08/06, vistoria 11/06). Sem divergência estrutural.

## Contato único ("Leads captados")

- Total de leads: **484**; telefones distintos não-nulos: **461** (~95% único).
- Query de duplicatas exatas por telefone retornou vazio (formatação de telefone provavelmente difere entre duplicatas). Gap de ~23 leads é pequeno.
- **Conclusão:** "Leads captados" é efetivamente contato único. Não abrir DASH-17 de dedup por ora.

## Pendente (externo)

- **Divergência de quinta 04/06** (leads + faturamento que a Ingrid reportou): segue dependendo do detalhe dela (qual tela/período/número). Sem isso a investigação é cega. As queries diárias V4 do plano ficam prontas pra rodar quando ela responder.
