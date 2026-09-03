import { appendApprovedProspectOutreachPacket } from '../service-outreach-packet-agent.mjs';
import {
  prospectIdsFromProspectReviewApproval
} from './executive-approval-plan.mjs';
import { applyProspectStageTransition } from './prospect-stage-transition.mjs';
import {
  applyOutreachApprovalTransition,
  buildOutreachApprovalPacket
} from './prospect-outreach-approval.mjs';

export function buildApprovedFollowthroughPlan({
  approvalQueue,
  pipeline,
  deliveryKit,
  packetQueue,
  generatedAtUtc = new Date().toISOString()
}) {
  return processApprovedFollowthrough({
    approvalQueue,
    pipeline,
    deliveryKit,
    packetQueue,
    generatedAtUtc
  });
}

export function applyApprovedFollowthrough({
  approvalQueue,
  pipeline,
  deliveryKit,
  packetQueue,
  generatedAtUtc = new Date().toISOString()
}) {
  return processApprovedFollowthrough({
    approvalQueue,
    pipeline,
    deliveryKit,
    packetQueue,
    generatedAtUtc
  });
}

function processApprovedFollowthrough({
  approvalQueue,
  pipeline,
  deliveryKit,
  packetQueue,
  generatedAtUtc
}) {
  assertInputs({ approvalQueue, pipeline, deliveryKit });
  let nextApprovalQueue = structuredClone(approvalQueue);
  let nextPipeline = structuredClone(pipeline);
  let nextPacketQueue = normalizePacketQueue(packetQueue, pipeline);
  const actions = [];

  for (const item of nextApprovalQueue.items ?? []) {
    if (item.status !== 'approved-by-chairman') continue;

    if (item.id?.startsWith('prospect-review-batch-')) {
      if ((nextPipeline.prospects ?? []).some((prospect) => prospect.stageApprovalId === item.id)) {
        continue;
      }
      const prospectIds = prospectIdsFromProspectReviewApproval({
        approvalItem: item,
        prospectPipeline: nextPipeline
      }).filter((id) => findProspect(nextPipeline, id)?.stage === 'identified');
      if (prospectIds.length === 0) continue;

      nextPipeline = applyProspectStageTransition({
        pipeline: nextPipeline,
        approvalQueue: nextApprovalQueue,
        approvalId: item.id,
        prospectIds,
        transitionedAtUtc: generatedAtUtc
      });
      actions.push({
        type: 'prospect-review-advanced',
        approvalId: item.id,
        prospectIds
      });

      const packet = buildOutreachApprovalPacket({
        pipeline: nextPipeline,
        prospectIds,
        generatedAtUtc
      });
      if (!(nextApprovalQueue.items ?? []).some((candidate) => candidate.id === packet.approvalItem.id)) {
        nextApprovalQueue = {
          ...nextApprovalQueue,
          updatedAtUtc: generatedAtUtc,
          items: [...(nextApprovalQueue.items ?? []), packet.approvalItem]
        };
        actions.push({
          type: 'outreach-approval-drafted',
          approvalId: packet.approvalItem.id,
          prospectIds
        });
      }
      continue;
    }

    if (item.id?.startsWith('outreach-approval-')) {
      if ((nextPipeline.prospects ?? []).some((prospect) => prospect.outreachApprovalId === item.id)) {
        continue;
      }
      const prospectIds = prospectIdsFromOutreachApprovalTitle(item.title).filter(
        (id) => findProspect(nextPipeline, id)?.stage === 'chairman-review'
      );
      if (prospectIds.length === 0) continue;

      nextPipeline = applyOutreachApprovalTransition({
        pipeline: nextPipeline,
        approvalQueue: nextApprovalQueue,
        approvalId: item.id,
        prospectIds,
        transitionedAtUtc: generatedAtUtc
      });
      actions.push({
        type: 'outreach-approval-advanced',
        approvalId: item.id,
        prospectIds
      });

      for (const prospectId of prospectIds) {
        try {
          nextPacketQueue = appendApprovedProspectOutreachPacket({
            queue: nextPacketQueue,
            pipeline: nextPipeline,
            deliveryKit,
            prospectId,
            generatedAtUtc
          });
          actions.push({
            type: 'manual-outreach-packet-written',
            prospectId,
            packetId: nextPacketQueue.packets.at(-1)?.id
          });
        } catch (error) {
          if (!/active outreach packet already exists/i.test(error.message)) throw error;
          actions.push({
            type: 'manual-outreach-packet-skipped',
            prospectId,
            reason: error.message
          });
        }
      }
    }
  }

  return {
    project: pipeline.project,
    mode: 'approved-only-followthrough',
    generatedAtUtc,
    actions,
    changed: actions.some((action) => !action.type.endsWith('-skipped')),
    approvalQueue: nextApprovalQueue,
    pipeline: nextPipeline,
    packetQueue: nextPacketQueue,
    boundary:
      'This agent only follows through on already-approved records. It does not approve items, contact prospects, send invoices, move assets, grant tokens, or make public commitments.'
  };
}

function assertInputs({ approvalQueue, pipeline, deliveryKit }) {
  if (!approvalQueue || typeof approvalQueue !== 'object') throw new Error('Missing approval queue.');
  if (!pipeline || typeof pipeline !== 'object') throw new Error('Missing prospect pipeline.');
  if (!deliveryKit || typeof deliveryKit !== 'object') throw new Error('Missing delivery kit.');
}

function normalizePacketQueue(queue, pipeline) {
  return structuredClone({
    project: queue?.project ?? pipeline.project,
    schemaVersion: 1,
    updatedAtUtc: queue?.updatedAtUtc ?? null,
    mode: 'manual-service-outreach-packet-queue',
    boundary:
      'Packets are approved factual outreach drafts only. Sending, contact evidence, invoices, payments, paid work, token grants, and asset movement remain separately gated.',
    packets: queue?.packets ?? []
  });
}

function findProspect(pipeline, id) {
  return (pipeline.prospects ?? []).find((prospect) => prospect.id === id);
}

function prospectIdsFromOutreachApprovalTitle(title) {
  const match = /^Approve factual outreach to (?<ids>.+)$/i.exec(title ?? '');
  return (match?.groups?.ids ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}
