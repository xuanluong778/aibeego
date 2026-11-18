import assert from 'node:assert/strict';
import type { LandingPageBlock } from '../packages/shared/src/landing-page-types';
import { isRegistrationPair } from '../apps/web/src/components/landing-pages/landing-page-registration-layout';
const countdown = {id:'counter',type:'Countdown',enabled:true,style:{customCss:'float:var(--lp-registration-float,left);width:var(--lp-registration-width,50%);zoom:var(--lp-registration-scale,1.34)'}} as LandingPageBlock;
const form = {id:'form',type:'LeadForm',enabled:true,style:{customCss:'float:var(--lp-registration-float,left);width:var(--lp-registration-width,50%)'}} as LandingPageBlock;
assert.equal(isRegistrationPair(countdown,form),true);
assert.equal(isRegistrationPair(form,countdown),false);
assert.equal(isRegistrationPair(countdown),false);
for(const patch of [{hidden:true},{enabled:false},{positionMode:'free'},{sectionPlacement:{sectionId:'x'}},{style:{customCss:''}}]) {
 assert.equal(isRegistrationPair({...countdown,...patch} as LandingPageBlock,form),false);
 assert.equal(isRegistrationPair(countdown,{...form,...patch} as LandingPageBlock),false);
}
assert.equal(isRegistrationPair({...countdown,style:{customCss:'--lp-registration-template-palette:1'}} as LandingPageBlock,form),false);
console.log('PASS registration pair detection: legacy variables, order, absent partner, hidden, disabled, free, nested and normal sections');
