import approvalQueue from '@/public/executive-approval-queue.json';
import prospectPipeline from '@/public/sats-prospect-pipeline.json';
import report from '@/public/transparency/latest.json';

export const metadata = {
  title: 'SATA Operations Queue',
  description:
    'Current SATA reserve-growth operating queue, chairman approvals, and prospect review status.',
  alternates: {
    canonical: 'https://sata-project-reserve.github.io/sata/operations'
  }
};

const PUBLIC_BASE_URL = 'https://sata-project-reserve.github.io/sata';

type ApprovalItem = (typeof approvalQueue.items)[number];
type Prospect = (typeof prospectPipeline.prospects)[number];

function countByStatus(items: ApprovalItem[]) {
  return items.reduce<Record<string, number>>((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {});
}

function countByStage(items: Prospect[]) {
  return items.reduce<Record<string, number>>((counts, item) => {
    counts[item.stage] = (counts[item.stage] ?? 0) + 1;
    return counts;
  }, {});
}

function approvalPhrase(id: string) {
  return `I am Executive Chairman and approve ${id}`;
}

function rejectionPhrase(id: string) {
  return `I am Executive Chairman and reject ${id}`;
}

function approvalCommand(item: ApprovalItem) {
  return `npm run ops:approve -- ${item.id} --confirm-chairman-approval "${approvalPhrase(item.id)}"`;
}

function rejectionCommand(item: ApprovalItem) {
  return `npm run ops:reject -- ${item.id} --confirm-chairman-rejection "${rejectionPhrase(item.id)}"`;
}

function nextCommandAfterApproval(item: ApprovalItem) {
  if (item.id === 'prospect-review-batch-20260829') {
    return `npm run ops:prospect-stage-plan, then node scripts/sats-prospect-stage-agent.mjs advance --approvalId ${item.id} --prospects "<chairman-selected-prospect-ids>"`;
  }
  if (item.id === 'reserve-growth-operating-policy') return 'npm run ops:reserve-plan';
  if (item.id === 'standard-promoter-intake-policy') return 'npm run ops:plan';
  return 'npm run ops:cycle-plan';
}

export default function OperationsPage() {
  const approvalCounts = countByStatus(approvalQueue.items);
  const prospectCounts = countByStage(prospectPipeline.prospects);
  const reviewItems = approvalQueue.items.filter(
    (item) => item.status === 'ready-for-chairman-review'
  );
  const reviewBatch = prospectPipeline.prospects
    .filter((prospect) => prospect.stage === 'identified')
    .slice(0, prospectPipeline.dailyCadence.chairmanReviewBatchSize);

  return (
    <main className="public-page">
      <section className="public-hero">
        <div>
          <span className="eyebrow">SATA operations</span>
          <h1>Reserve growth queue.</h1>
          <p>
            Current operating view for moving from public evidence to chairman review, approved
            outreach, exact-sats invoices, confirmed receipts, and reserve allocation records.
          </p>
          <p>
            Agents prepare packets and validations. The Executive Chairman approves final proposals,
            outreach, invoices, paid promotion, token grants, transactions, and asset movement.
          </p>
          <div className="inline-actions">
            <a className="button-link" href="/transparency">
              Transparency
            </a>
            <a className="button-link" href="/services/transparency-audit">
              Audit Service
            </a>
            <a className="button-link" href="/executive-approval-queue.json">
              Approval JSON
            </a>
            <a className="button-link" href="/sats-prospect-pipeline.json">
              Prospect JSON
            </a>
          </div>
        </div>
        <div className="proof-stack">
          <div className="metric">
            <span>Confirmed Reserve</span>
            <strong>{report.bitcoinReserve.confirmedReserveSats} sats</strong>
          </div>
          <div className="metric">
            <span>Target</span>
            <strong>1,000,000,000 sats</strong>
          </div>
          <div className="metric">
            <span>Latest Report</span>
            <strong>{report.generatedAtUtc}</strong>
          </div>
          <div className="metric">
            <span>Chairman Review Items</span>
            <strong>{reviewItems.length}</strong>
          </div>
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Approval Queue</h2>
          <p>Current proposal states from the public executive approval queue.</p>
        </div>
        <div className="summary-grid">
          {Object.entries(approvalCounts).map(([status, count]) => (
            <div className="metric" key={status}>
              <span>{status}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
        <div className="warning-list">
          {reviewItems.map((item) => (
            <div className="proof-block" key={item.id}>
              <span>{item.category}</span>
              <strong>{item.title}</strong>
              <code>{item.id}</code>
              <p>{item.proposedAction}</p>
              <div className="command-list">
                <span>Approve</span>
                <code>{approvalCommand(item)}</code>
                <span>Reject</span>
                <code>{rejectionCommand(item)}</code>
                <span>After approval</span>
                <code>{nextCommandAfterApproval(item)}</code>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Prospect Pipeline</h2>
          <p>Evidence-backed candidates remain blocked until chairman review and later outreach approval.</p>
        </div>
        <div className="summary-grid">
          {Object.entries(prospectCounts).map(([stage, count]) => (
            <div className="metric" key={stage}>
              <span>{stage}</span>
              <strong>{count}</strong>
            </div>
          ))}
          <div className="metric">
            <span>Candidate Intake</span>
            <strong>
              <a href={prospectPipeline.prospectIntakeUrl}>GitHub issue form</a>
            </strong>
          </div>
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Next Review Batch</h2>
          <p>First candidates selected by the prospect review packet command.</p>
        </div>
        <div className="warning-list">
          {reviewBatch.map((prospect) => (
            <div className="proof-block" key={prospect.id}>
              <span>{prospect.recommendedOfferId}</span>
              <strong>{prospect.id}</strong>
              <p>{prospect.observedClaim}</p>
              <code>{prospect.projectUrl}</code>
            </div>
          ))}
        </div>
        <div className="notice">
          <strong>Command</strong>
          <span>
            Run <code>npm run ops:prospect-review-plan</code> for the machine-readable packet, then
            approve or reject through the public approval queue process.
          </span>
        </div>
      </section>

      <section className="public-band">
        <div className="notice">
          <strong>Boundary</strong>
          <span>
            No price guarantee, redemption promise, revenue guarantee, market-support commitment, or
            autonomous asset movement. Public reports:
            <a href={`${PUBLIC_BASE_URL}/transparency/latest.json`}> latest.json</a>
          </span>
        </div>
      </section>
    </main>
  );
}
