import Shot, { type ShotName } from "@/components/Shot";

/** A real screenshot at the site's one scale, with a caption saying what it shows. */
export default function Figure({ shot, alt, caption }: { shot: ShotName; alt: string; caption: string; max?: number }) {
  return <Shot name={shot} alt={alt} caption={caption} className="dx-fig" />;
}
