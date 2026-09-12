import Image from 'next/image';

export default function Brand() {
  return (
    <span className="linkedfly-brand">
      <Image
        src="/linkedfly-logo.png"
        alt=""
        width={80}
        height={80}
        unoptimized
        priority
      />
      <span>
        Linked<span className="linkedfly-gold">Fly</span>
      </span>
    </span>
  );
}
