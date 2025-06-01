import { twMerge } from 'tailwind-merge';

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'link';
  type?: 'button' | 'submit' | 'reset';
  text?: string;
  icon?: preact.ComponentChildren;
  class?: string;
  onClick?: (e: Event) => void;
};

export default function Button({
  variant = 'secondary',
  type = 'button',
  text = '',
  icon,
  class: className = '',
  onClick,
}: ButtonProps) {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    tertiary: 'btn btn-tertiary',
    link: 'cursor-pointer hover:text-primary',
  };

  return (
    <button
      type={type}
      class={twMerge(variants[variant] || '', className)}
      onClick={onClick}
    >
      {text}
      {icon && <span class="ml-2">{icon}</span>}
    </button>
  );
}
