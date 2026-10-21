import Link from "next/link";
import { IntroStatus } from "@/components/IntroStatus";
import { PageHeader } from "@/components/ui";
import { getOpportunity, getSponsor, listIntros } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Intros — Perspective" };

export default async function IntrosPage() {
  const intros = await listIntros();
  const rows = await Promise.all(
    intros.map(async (i) => ({ intro: i, opp: await getOpportunity(i.opportunityId), sp: await getSponsor(i.sponsorId) })),
  );

  return (
    <>
      <PageHeader eyebrow="For connectors" title="Warm intro pipeline">
        Every intro runs double opt-in: ask the sponsor first, introduce once they say yes, then track the outcome. Outcomes feed back into future matching.
      </PageHeader>
      {rows.length === 0 ? (
        <div className="card p-10 text-center text-muted">
          No intro requests yet. Open any <Link className="text-brand hover:underline" href="/opportunities">listing</Link> and hit “Request warm intro” on a match.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Opportunity</th>
                <th className="px-5 py-3 font-semibold">Sponsor</th>
                <th className="px-5 py-3 font-semibold">Fit</th>
                <th className="px-5 py-3 font-semibold">Requested</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ intro, opp, sp }) => (
                <tr key={intro.id}>
                  <td className="px-5 py-3">{opp ? <Link className="hover:underline" href={`/opportunities/${opp.id}`}>{opp.title}</Link> : "—"}</td>
                  <td className="px-5 py-3">{sp ? <Link className="hover:underline" href={`/sponsors/${sp.id}`}>{sp.name}</Link> : "—"}</td>
                  <td className="px-5 py-3 tabular-nums">{intro.score}</td>
                  <td className="px-5 py-3 text-muted">{new Date(intro.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3"><IntroStatus id={intro.id} status={intro.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
