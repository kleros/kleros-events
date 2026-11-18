import { currentUser } from "@/lib/supabase/server";
import SwitchAccount, { SignInLink } from "@/components/SwitchAccount";

// Reads the signed-in user itself, so pages keep rendering <NotTeam /> with no props.
export default async function NotTeam({ next }: { next?: string } = {}) {
  const { user } = await currentUser();
  const email = user?.email ?? "";
  return (
    <div className="wrap page" style={{ maxWidth: 620 }}>
      <div className="panel">
        <h1>Team only</h1>
        {user ? (
          <>
            <p style={{ margin: 0 }}>{email ? <>Signed in as <b>{email}</b>, which does not have team access.</> : "This account does not have team access."}</p>
            <p className="muted" style={{ margin: 0 }}>
              This area is for the Kleros events team. Team accounts use an @kleros.io email. Wei Wei Ooi can also give another email access on the Who can sign in page.
            </p>
            <div className="row-flex">
              <SwitchAccount next={next} />
              <a className="btn ghost" href={`mailto:weiwei@kleros.io?subject=${encodeURIComponent(email ? `Team access for ${email}` : "Team access")}`}>Ask Wei Wei for access</a>
            </div>
          </>
        ) : (
          <>
            <p className="muted" style={{ margin: 0 }}>
              This area is for the Kleros events team. Sign in with an @kleros.io email, or with an email Wei Wei Ooi has given access.
            </p>
            <div className="row-flex"><SignInLink next={next} /></div>
          </>
        )}
      </div>
    </div>
  );
}
