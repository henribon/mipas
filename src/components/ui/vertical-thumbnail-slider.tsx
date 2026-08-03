'use client';
import {
  Carousel,
  Slider,
  SliderContainer,
  ThumbsSlider,
} from '@/components/ui/vertical-thumbnail-slider-utils/carousel';
import type { EmblaOptionsType } from 'embla-carousel';
import React from 'react';

export type FotoSlide = { id: string; url: string; title?: string | null };

function VerticalthumbsSlider({
  fotos,
  startIndex = 0,
  alturaClasse = 'h-[400px]',
}: {
  fotos: FotoSlide[];
  startIndex?: number;
  alturaClasse?: string;
}) {
  const OPTIONS: EmblaOptionsType = {
    loop: false,
    axis: 'y',
    startIndex,
  };
  return (
    <Carousel options={OPTIONS} className="relative flex gap-2">
      <SliderContainer className={`gap-2 ${alturaClasse} w-full`}>
        {fotos.map(f => (
          <Slider key={f.id} className="h-full w-full" thumbnailSrc={f.url}>
            <img src={f.url} alt={f.title || 'image'} className="h-full object-contain rounded-lg w-full" />
          </Slider>
        ))}
      </SliderContainer>
      {fotos.length > 1 && (
        <ThumbsSlider className="w-20" thumbsClassName={alturaClasse} thumbsSliderClassName="border-primary" />
      )}
    </Carousel>
  );
}

export default VerticalthumbsSlider;
