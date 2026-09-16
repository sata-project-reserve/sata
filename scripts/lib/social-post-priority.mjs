const PRIORITY_RULES = [
  {
    tier: 1,
    reason: 'approved revenue-service offer',
    matches: (post) =>
      post.type === 'revenue' &&
      /\b(transparency audits?|service|monitoring|customer|invoice)\b/i.test(post.text ?? '')
  },
  {
    tier: 2,
    reason: 'approved revenue post',
    matches: (post) => post.type === 'revenue'
  },
  {
    tier: 3,
    reason: 'approved status post with revenue-first context',
    matches: (post) => /\brevenue first\b/i.test(post.text ?? '')
  },
  {
    tier: 4,
    reason: 'approved transparency proof',
    matches: (post) => ['transparency', 'education'].includes(post.type)
  }
];

export function prioritizeApprovedSocialPosts({ posts }) {
  return (posts ?? [])
    .map((post, index) => {
      const rule = PRIORITY_RULES.find((candidate) => candidate.matches(post)) ?? {
        tier: 9,
        reason: 'approved backlog order'
      };
      return {
        post,
        index,
        priority: {
          tier: rule.tier,
          reason: rule.reason
        }
      };
    })
    .sort((left, right) => left.priority.tier - right.priority.tier || left.index - right.index)
    .map(({ post, priority }) => ({
      ...post,
      socialPriority: priority
    }));
}
