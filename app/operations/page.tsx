import approvalQueue from '@/public/executive-approval-queue.json';
import outreachPacketQueue from '@/public/service-outreach-packet-queue.json';
import prospectPipeline from '@/public/sats-prospect-pipeline.json';
import cycleStatus from '@/public/revenue-cycle-status.json';
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

function nextCommandAfterApproval(item: ApprovalItem, reviewBatch: Prospect[]) {
  if (item.id.startsWith('prospect-review-batch-')) {
    const prospectIds = reviewBatch.map((prospect) => prospect.id).join(',');
    return `node scripts/sats-prospect-stage-agent.mjs plan --approvalId ${item.id}, then node scripts/sats-prospect-stage-agent.mjs advance --approvalId ${item.id} --prospects ${prospectIds}`;
  }
  if (item.id === 'reserve-growth-operating-policy') return 'npm run ops:reserve-plan';
  if (item.id === 'standard-promoter-intake-policy') return 'npm run ops:plan';
  if (item.id.startsWith('outreach-approval-')) {
    const prospectIds = outreachProspectIdsFromTitle(item.title);
    return `node scripts/sats-outreach-approval-agent.mjs transition-plan --approvalId ${item.id}, then node scripts/sats-outreach-approval-agent.mjs advance --approvalId ${item.id} --prospects ${prospectIds || '<chairman-approved-prospect-ids>'}`;
  }
  return 'npm run ops:cycle-plan';
}

function outreachProspectIdsFromTitle(title: string) {
  const match = /^Approve factual outreach to (?<ids>.+)$/.exec(title);
  const ids = match?.groups?.ids;
  if (!ids) return '';
  return ids
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .join(',');
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
  const chairmanReviewProspects = prospectPipeline.prospects.filter(
    (prospect) => prospect.stage === 'chairman-review'
  );
  const outreachApprovedProspects = prospectPipeline.prospects.filter(
    (prospect) => prospect.stage === 'outreach-approved'
  );
  const contactedProspects = prospectPipeline.prospects.filter(
    (prospect) => prospect.stage === 'contacted'
  );
  const invoiceRequestedProspects = prospectPipeline.prospects.filter(
    (prospect) => prospect.stage === 'invoice-requested'
  );

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
            <a className="button-link" href="/service-outreach-packet-queue.json">
              Outreach Queue
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
          <h2>Cycle Status</h2>
          <p>{cycleStatus.objective}</p>
        </div>
        <div className="summary-grid">
          <div className="metric">
            <span>Remaining To Target</span>
            <strong>{Number(cycleStatus.currentReserve.remainingSats).toLocaleString('en-US')} sats</strong>
          </div>
          <div className="metric">
            <span>Remaining BTC</span>
            <strong>{cycleStatus.currentReserve.remainingBtc} BTC</strong>
          </div>
          <div className="metric">
            <span>Approved Invoices</span>
            <strong>{cycleStatus.funnel.approvedInvoices}</strong>
          </div>
          <div className="metric">
            <span>Receipts Awaiting Allocation</span>
            <strong>{cycleStatus.funnel.receiptsAwaitingAllocation}</strong>
          </div>
          <div className="metric">
            <span>Ready Outreach Packets</span>
            <strong>{cycleStatus.funnel.readyOutreachPackets}</strong>
          </div>
          <div className="metric">
            <span>Approved Posts</span>
            <strong>{cycleStatus.social.approvedPosts}</strong>
          </div>
          <div className="metric">
            <span>Ready Posts</span>
            <strong>{cycleStatus.social.readyForReviewPosts}</strong>
          </div>
        </div>
        <div className="notice">
          <strong>Next Action</strong>
          <span>{cycleStatus.nextAction}</span>
        </div>
        <div className="warning-list">
          {cycleStatus.blockers.map((blocker) => (
            <div className="proof-block" key={blocker}>
              <span>blocker</span>
              <strong>{blocker}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Priority Action Queue</h2>
          <p>Executable revenue-cycle actions, ordered by current operating priority.</p>
        </div>
        <div className="warning-list">
          {cycleStatus.actionQueue.map((action) => (
            <div className="proof-block" key={action.id}>
              <span>
                #{action.priority} {action.type}
              </span>
              <strong>{action.title}</strong>
              <p>{action.boundary}</p>
              <div className="command-list">
                <span>Required Actor</span>
                <code>{action.requiredActor}</code>
                <span>Evidence Required</span>
                <code>{action.evidenceRequired}</code>
                <span>Command</span>
                <code>{action.command}</code>
              </div>
            </div>
          ))}
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
                <code>{nextCommandAfterApproval(item, reviewBatch)}</code>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Manual Outreach Packets</h2>
          <p>Approved factual messages waiting for human send and contact evidence.</p>
        </div>
        <div className="warning-list">
          {outreachPacketQueue.packets.map((packet) => (
            <div className="proof-block" key={packet.id}>
              <span>{packet.status}</span>
              <strong>{packet.prospectId}</strong>
              <code>{packet.id}</code>
              <p>{packet.sendInstructions}</p>
              <pre className="preview">{packet.message}</pre>
              <div className="command-list">
                <span>Record Contact</span>
                <code>{packet.recordContactCommand}</code>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Reply Conversion</h2>
          <p>Evidence commands for turning approved outreach into invoice-ready revenue records.</p>
        </div>
        <div className="warning-list">
          {outreachApprovedProspects.map((prospect) => (
            <div className="proof-block" key={`contact-${prospect.id}`}>
              <span>after approved outreach is sent</span>
              <strong>{prospect.id}</strong>
              <p>Record durable contact evidence before treating the prospect as contacted.</p>
              <div className="command-list">
                <span>Record Contacted</span>
                <code>
                  node scripts/sats-prospect-response-agent.mjs record-contacted --prospect{' '}
                  {prospect.id} --evidence &quot;&lt;contact-evidence-url-or-reference&gt;&quot;
                  --channel &quot;manual-dm-or-email&quot;
                </code>
              </div>
            </div>
          ))}
          {contactedProspects.map((prospect) => (
            <div className="proof-block" key={`invoice-request-${prospect.id}`}>
              <span>after customer asks for invoice</span>
              <strong>{prospect.id}</strong>
              <p>Record the customer invoice request before preparing exact-sats quote inputs.</p>
              <div className="command-list">
                <span>Record Invoice Request</span>
                <code>
                  node scripts/sats-prospect-response-agent.mjs record-invoice-request --prospect{' '}
                  {prospect.id} --offer {prospect.recommendedOfferId} --evidence
                  &quot;&lt;invoice-request-evidence-url-or-reference&gt;&quot;
                  --confirmedCustomerRequestedInvoice true
                </code>
              </div>
            </div>
          ))}
          {invoiceRequestedProspects.map((prospect) => (
            <div className="proof-block" key={`quote-${prospect.id}`}>
              <span>invoice request recorded</span>
              <strong>{prospect.id}</strong>
              <p>Prepare quote inputs, then submit the exact-sats invoice for chairman approval.</p>
              <div className="command-list">
                <span>Quote Plan</span>
                <code>npm run ops:invoice-quote-plan</code>
                <span>Invoice Request Packet</span>
                <code>
                  node scripts/sats-invoice-request-agent.mjs render --prospect {prospect.id}
                </code>
              </div>
            </div>
          ))}
          {contactedProspects.length === 0 && invoiceRequestedProspects.length === 0 ? (
            <div className="notice">
              <strong>Current Reply State</strong>
              <span>No contacted prospects or invoice requests are recorded yet.</span>
            </div>
          ) : null}
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
          <h2>Chairman Review Prospects</h2>
          <p>Approved for prospect review only. Outreach still requires a separate explicit decision.</p>
        </div>
        <div className="warning-list">
          {chairmanReviewProspects.map((prospect) => (
            <div className="proof-block" key={prospect.id}>
              <span>{prospect.recommendedOfferId}</span>
              <strong>{prospect.id}</strong>
              <p>{prospect.observedClaim}</p>
              <code>{prospect.stageApprovalId}</code>
            </div>
          ))}
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
