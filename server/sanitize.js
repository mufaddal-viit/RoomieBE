const isObject = value => value !== null && typeof value === 'object';

export const withoutPassword = roommate => {
  if (!isObject(roommate)) return roommate;
  const { password, ...rest } = roommate;
  return rest;
};

export const withoutPasswords = roommates => {
  if (!Array.isArray(roommates)) return roommates;
  return roommates.map(withoutPassword);
};
