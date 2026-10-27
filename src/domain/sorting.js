export function mergeSort(items, compare) {
  const source = Array.from(items);
  if (source.length < 2) return source;

  const target = new Array(source.length);
  let input = source;
  let output = target;

  for (let width = 1; width < source.length; width *= 2) {
    for (let start = 0; start < source.length; start += width * 2) {
      const middle = Math.min(start + width, source.length);
      const end = Math.min(start + width * 2, source.length);
      let left = start;
      let right = middle;
      let write = start;

      while (left < middle && right < end) {
        if (compare(input[left], input[right]) <= 0) output[write++] = input[left++];
        else output[write++] = input[right++];
      }
      while (left < middle) output[write++] = input[left++];
      while (right < end) output[write++] = input[right++];
    }
    [input, output] = [output, input];
  }

  return input;
}
