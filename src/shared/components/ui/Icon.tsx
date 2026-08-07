import * as LucideIcons from 'lucide-react';
import { LucideProps } from 'lucide-react';

export type IconName = keyof typeof LucideIcons;

interface IconProps extends LucideProps {
  name: IconName;
}

export function Icon({ name, size = 20, color = 'currentColor', className, ...props }: IconProps) {
  const LucideIcon = LucideIcons[name] as React.FC<LucideProps> | undefined;

  if (!LucideIcon) {
    console.warn(`Icon "${name}" not found in lucide-react`);
    return <LucideIcons.HelpCircle size={size} color={color} className={className} {...props} />;
  }

  return <LucideIcon size={size} color={color} className={className} {...props} />;
}
