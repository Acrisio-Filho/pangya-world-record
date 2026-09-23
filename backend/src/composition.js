function createApplication() {
  const identity = createIdentityModule({ GOOGLE_CLIENT_ID, googleIdentity, ids: { next: () => Utilities.getUuid() }, _append, _authUser, _clearFailedLogins, _effPoints, _findUserByEmail, _findUserById, _hash, _isAdmin, _loginBlocked, _newSession, _page, _publicUser, _recalcBest, _registerFailedLogin, _rows, _table, _toObj, _youtubeOk });
  const catalog = createCatalogModule({ ids: { next: () => Utilities.getUuid() }, _append, _authUser, _isAdmin, _recalcBest, _rows, _table, _toObj });
  const records = createRecordsModule({ METHODS, PTS_ADMIN_OK, PTS_IMPROVE_ADMIN, RecordPolicy, RecordDraft, ids: { next: () => Utilities.getUuid() }, WINDS, _addPoints, _append, _authUser, _bandForPower, _isLiveRow, _makeProposal, _page, _recalcBest, _rows, _table, _toObj, _urlOk });
  const community = createCommunityModule({ PTS_COM_OK, PTS_IMPROVE_COM, ids: { next: () => Utilities.getUuid() }, VotingPolicy, _addPoints, _append, _authUser, _effPoints, _recalcBest, _rows, _table, _tally, _toObj });
  return {
    get: { getUser: identity, getMe: identity, listUsers: identity, listPendingUsers: identity, listCourses: catalog, listBands: catalog, listRecords: records, listPending: records, tally: community, tallies: community, myVotes: community },
    post: { register: identity, login: identity, loginGoogle: identity, logout: identity, updateMe: identity, changePassword: identity, deleteMe: identity, setUserStatus: identity, adminResetPassword: identity, upsertBand: catalog, upsertCourse: catalog, deleteBand: catalog, deleteCourse: catalog, submitRecord: records, validateRecord: records, updateRecord: records, vote: community, appealVote: community, reopenVote: community },
  };
}
