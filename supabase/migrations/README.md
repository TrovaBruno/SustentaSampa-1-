# Migrations

Estes arquivos SQL documentam o schema do projeto Supabase já existente
(tabelas `profiles`, `flood_reports`, `chat_messages`, RLS e triggers).

Você **não precisa rodar nada aqui** para continuar usando o mesmo banco —
esse Supabase nunca foi uma dependência da Lovable, é um projeto seu, e o
`.env` deste repositório já aponta para ele.

Use estes arquivos apenas se um dia precisar recriar o schema do zero em um
projeto Supabase novo (ex.: `supabase db push` com a Supabase CLI).
