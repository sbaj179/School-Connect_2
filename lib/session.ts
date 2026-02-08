import { supabaseBrowser } from "./supabase-browser";

function syncAuthCookies() {
  const session = supabaseBrowser.auth.getSession();
  void session.then(({ data }) => {
    if (!data.session) return;
    document.cookie = `sb-access-token=${data.session.access_token}; Path=/`;
    document.cookie = `sb-refresh-token=${data.session.refresh_token}; Path=/`;
  });
}

export async function validateSession() {
  const { data: sessionData } = await supabaseBrowser.auth.getSession();
  if (!sessionData.session) {
    return { user: null, error: "no-session" };
  }

  const { data: userData, error: userError } = await supabaseBrowser.auth.getUser();
  if (userError || !userData.user) {
    await supabaseBrowser.auth.signOut();
    return { user: null, error: "stale-session" };
  }

  syncAuthCookies();

  return { user: userData.user, error: null };
}
