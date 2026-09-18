import type { CSSProperties } from 'react';
import { ICON_SPRITE, type IconId } from './icons-sprite';

/** Sprite único con todos los símbolos; se monta una vez en App. */
export function IconSprite() {
  return <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: `<defs>${ICON_SPRITE}</defs>` }} />;
}

/** Icono dúo-tono del set propio. Hereda el color del texto. */
export function Icon({ id, className, style, title }: { id: IconId; className?: string; style?: CSSProperties; title?: string }) {
  return (
    <svg className={className} style={style} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <use href={`#i-${id}`} />
    </svg>
  );
}

export type { IconId };
