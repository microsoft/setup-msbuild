export function lt(
  a: [number, number, number, number],
  b: [number, number, number, number]
): boolean {
  for (let index = 0; index < 4; index++) {
    if (a[index] < b[index]) {
      return true
    } else if (a[index] > b[index]) {
      return false
    }
  }
  return false
}

export function lte(
  a: [number, number, number, number],
  b: [number, number, number, number]
): boolean {
  return !gt(a, b)
}

export function gt(
  a: [number, number, number, number],
  b: [number, number, number, number]
): boolean {
  for (let index = 0; index < 4; index++) {
    if (a[index] > b[index]) {
      return true
    } else if (a[index] < b[index]) {
      return false
    }
  }
  return false
}

export function gte(
  a: [number, number, number, number],
  b: [number, number, number, number]
): boolean {
  return !lt(a, b)
}

export function eq(
  a: [number, number, number, number],
  b: [number, number, number, number]
): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]
}
