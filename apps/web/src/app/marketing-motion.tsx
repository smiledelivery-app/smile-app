'use client';

import { useEffect } from 'react';

const revealSelector='.s-heading,.s-step-grid article,.s-section-top,.s-mood,.s-neighbour-image,.s-neighbour>div:last-child,.s-audience,.s-download>*:not(div),.s-benefits>div,.s-benefit-grid article,.s-faqs details,.s-wide-cta>*';

export default function MarketingMotion(){
  useEffect(()=>{
    const root=document.documentElement;
    const progress=document.querySelector<HTMLElement>('[data-smile-progress]');
    const updateProgress=()=>{const max=document.documentElement.scrollHeight-window.innerHeight; if(progress)progress.style.transform='scaleX('+Math.min(1,Math.max(0,window.scrollY/(max||1)))+')';root.dataset.smileScrolled=window.scrollY>420?'true':'false';};
    updateProgress(); window.addEventListener('scroll',updateProgress,{passive:true}); window.addEventListener('resize',updateProgress);
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const items=Array.from(document.querySelectorAll<HTMLElement>(revealSelector));
    if(!reduced){
      items.forEach((item,index)=>{item.classList.add('s-reveal');item.style.setProperty('--s-delay',String((index%3)*80)+'ms');});
      const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('s-visible');observer.unobserve(entry.target);}}),{threshold:.14,rootMargin:'0px 0px -44px'});
      items.forEach(item=>observer.observe(item));
      const sections=Array.from(document.querySelectorAll<HTMLElement>('.s-section,.s-neighbour,.s-audiences,.s-download,.s-benefits,.s-wide-cta,.s-faqs'));
      const tones=['cream','peach','green','lime','green','cream','lime'];
      const toneObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting)root.dataset.smileTone=tones[sections.indexOf(entry.target as HTMLElement)%tones.length];}),{threshold:.5});
      sections.forEach(section=>toneObserver.observe(section));
      const carousel=document.querySelector<HTMLElement>('.s-mood-grid');
      let timer:number|undefined;
      const media=window.matchMedia('(max-width: 850px)');
      const autoplay=()=>{window.clearInterval(timer);if(!media.matches||!carousel)return;timer=window.setInterval(()=>{const stride=carousel.firstElementChild?.getBoundingClientRect().width??0;const end=carousel.scrollWidth-carousel.clientWidth;if(carousel.scrollLeft>=end-2)carousel.scrollTo({left:0,behavior:'smooth'});else carousel.scrollBy({left:stride+12,behavior:'smooth'});},4200);};
      autoplay();media.addEventListener('change',autoplay);
      return()=>{window.removeEventListener('scroll',updateProgress);window.removeEventListener('resize',updateProgress);observer.disconnect();toneObserver.disconnect();media.removeEventListener('change',autoplay);window.clearInterval(timer);delete root.dataset.smileTone;};
    }
    return()=>{window.removeEventListener('scroll',updateProgress);window.removeEventListener('resize',updateProgress);};
  },[]);
  const whatsappUrl=process.env.NEXT_PUBLIC_SMILE_WHATSAPP_URL||'https://wa.me/';
  return <><div data-smile-progress aria-hidden="true"/><div className="s-quick-actions"><a href={whatsappUrl} target="_blank" rel="noreferrer" aria-label="Chat with Smile on WhatsApp"><span>◔</span><b>WhatsApp</b></a><button type="button" onClick={()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})} aria-label="Scroll to top">↑</button></div></>;
}
