import { Upload } from 'lucide-react';
import { useRef } from 'react';

export default function FileSelector({ callback, id, disabled }: any) {
  const fileInputRef = useRef(null);
  return (
    <div>
      <div
        onClick={() => {
          //@ts-ignore
          fileInputRef.current?.click();
        }}
        className="bg-opacityLight dark:bg-opacityDark flex h-20 w-20 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg duration-300 active:scale-95"
      >
        <Upload className="size-6" />
      </div>
      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        id={`file-${id}`}
        multiple
        accept="image/*"
        disabled={disabled}
        onInput={() => {
          const input = document.querySelector(`#file-${id}`) as HTMLInputElement;

          let files = input.files ? Object.values(input.files) : [];

          callback(files);
        }}
        title="Attachments Uploader"
      />
    </div>
  );
}
