import { splitPhone } from "@/lib/phone";

export function PhoneInputGroup({
  namePrefix,
  defaultValue,
}: {
  namePrefix: string;
  defaultValue?: string | null;
}) {
  const [part1, part2, part3] = splitPhone(defaultValue);

  return (
    <div className="flex items-center gap-1">
      <input
        name={`${namePrefix}1`}
        placeholder="010"
        defaultValue={part1}
        maxLength={4}
        className="w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-center text-sm"
      />
      <span className="text-gray-400">-</span>
      <input
        name={`${namePrefix}2`}
        placeholder="1234"
        defaultValue={part2}
        maxLength={4}
        className="w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-center text-sm"
      />
      <span className="text-gray-400">-</span>
      <input
        name={`${namePrefix}3`}
        placeholder="5678"
        defaultValue={part3}
        maxLength={4}
        className="w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-center text-sm"
      />
    </div>
  );
}
