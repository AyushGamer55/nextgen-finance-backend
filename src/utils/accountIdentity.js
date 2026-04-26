function buildSandboxIdentity(user) {
  const idString = String(user?._id || user?.id || '');
  const email = String(user?.email || '').toLowerCase();
  const name = String(user?.name || 'user').trim();
  const slugBase = email.split('@')[0] || name.replace(/\s+/g, '').toLowerCase() || 'user';
  const safeSlug = slugBase.replace(/[^a-z0-9]/g, '').slice(0, 12) || 'user';
  const suffix = idString.replace(/[^a-f0-9]/gi, '').slice(-6).padStart(6, '0');
  const accountNumber = `91${suffix}${suffix}`.slice(0, 14);
  const upiId = `${safeSlug}.${suffix}@mountdash`;

  return {
    sandboxUpiId: upiId,
    sandboxAccountNumber: accountNumber,
    sandboxIfsc: 'MTDS0001234',
    sandboxBankName: 'MountDash Sandbox Bank',
  };
}

module.exports = {
  buildSandboxIdentity,
};
