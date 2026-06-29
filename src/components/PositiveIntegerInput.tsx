import { useEffect, useState } from 'react';
import { TextInput, TextInputProps } from 'react-native';

type PositiveIntegerInputProps = Omit<TextInputProps, 'keyboardType' | 'onChangeText' | 'value'> & {
  minimum?: number;
  onChangeValue: (value: number) => void;
  value: number;
};

function sanitizePositiveInteger(value: string, minimum: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(minimum, parsed) : minimum;
}

export function PositiveIntegerInput({
  minimum = 1,
  onBlur,
  onChangeValue,
  onFocus,
  value,
  ...props
}: PositiveIntegerInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [text, setText] = useState(String(value));

  useEffect(() => {
    if (!isFocused) {
      setText(String(value));
    }
  }, [isFocused, value]);

  return (
    <TextInput
      {...props}
      keyboardType="number-pad"
      onBlur={(event) => {
        const nextValue = sanitizePositiveInteger(text, minimum);
        setIsFocused(false);
        setText(String(nextValue));
        onChangeValue(nextValue);
        onBlur?.(event);
      }}
      onChangeText={(nextText) => {
        setText(nextText);
        onChangeValue(sanitizePositiveInteger(nextText, minimum));
      }}
      onFocus={(event) => {
        setIsFocused(true);
        onFocus?.(event);
      }}
      value={text}
    />
  );
}
