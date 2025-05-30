export function SoftBottom({
  children,
  spacer,
  className,
}: {
  children?: React.ReactNode;
  spacer?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`from-bgLight via-bgLight/80 text-theme dark:from-bgDark dark:via-bgDark/80 pointer-events-none ${spacer ? 'sticky' : 'absolute'} bottom-0 left-0 w-full bg-gradient-to-t to-transparent pt-8 duration-300 ${className || ''}`}
    >
      {children}
    </div>
  );
}
