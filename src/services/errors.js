export function getErrorStatus(error) {
  return error?.response?.status ?? 0;
}

export function getErrorMessage(error, fallback) {
  const message = error?.response?.data?.message;
  if (typeof message === 'string' && message.length > 0) {
    return message;
  }
  if (error?.message) {
    return error.message;
  }
  return fallback;
}