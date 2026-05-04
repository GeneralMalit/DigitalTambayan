# TODO

- GitHub OAuth is not working yet.
- Supabase still needs the OAuth database/profile fallback handled before GitHub sign-in can be considered complete. New OAuth users need a safe temporary `pending_*` username or a separate profile-creation flow so first login does not break when GitHub does not provide the app's expected `username` metadata.
- Configure Supabase Auth > Providers > GitHub with the GitHub OAuth Client ID and Client Secret, then verify the redirect URLs for local and production.
