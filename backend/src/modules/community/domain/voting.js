const VotingPolicy = Object.freeze({
  decide(tally) {
    if (tally.voters < 3) return null;
    if (tally.approve >= 50 && tally.approve > 2 * tally.reject) return "approved";
    if (tally.reject >= 50 && tally.reject > 2 * tally.approve) return "rejected";
    return null;
  }
});
