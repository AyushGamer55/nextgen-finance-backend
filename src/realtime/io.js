let ioInstance = null;

function setIo(io) {
  ioInstance = io;
}

function getIo() {
  return ioInstance;
}

function emitToUser(userId, eventName, payload) {
  if (!ioInstance || !userId) {
    return;
  }

  ioInstance.to(`user:${String(userId)}`).emit(eventName, payload);
}

module.exports = {
  setIo,
  getIo,
  emitToUser,
};
