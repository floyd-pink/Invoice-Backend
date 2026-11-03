import { SetMetadata } from '@nestjs/common';
export const SKIP_BUSINESS_KEY = 'skipBusinessContext';
export const SkipBusinessContext = () => SetMetadata(SKIP_BUSINESS_KEY, true);
