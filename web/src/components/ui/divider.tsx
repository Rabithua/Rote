import * as React from 'react';

export function Divider({ className = '', ...props }: React.HTMLAttributes<HTMLHRElement>) {
  return (
    <hr
      className={
        'border-border my-4 border-t border-dashed opacity-60 dark:opacity-40 ' + className
      }
      {...props}
    />
  );
}

export default Divider;
