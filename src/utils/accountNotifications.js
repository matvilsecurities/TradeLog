const STORAGE_PREFIX = "tradelog:account-notifications:";

function storageKey(userId) {
  return `${STORAGE_PREFIX}${userId || "anonymous"}`;
}

export function readAccountNotifications(userId) {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(userId)) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function writeAccountNotifications(userId, notifications) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(notifications));
  } catch { /* non-blocking */ }
}

export function addAccountNotification(userId, notification) {
  if (!userId || !notification?.id) return false;
  const current = readAccountNotifications(userId);
  if (current.some((item) => item.id === notification.id)) return false;
  const next = [notification, ...current].slice(0, 50);
  writeAccountNotifications(userId, next);
  return true;
}
