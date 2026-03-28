import {
  IsString,
  IsArray,
  ValidateNested,
  IsOptional,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InboundConfigDto {
  @IsString()
  type: string;

  @IsOptional()
  port?: number | string;

  @IsString()
  @IsOptional()
  sni?: string;

  @IsString()
  @IsOptional()
  link?: string;
}

export class CreateSubscriptionDto {
  @IsString()
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InboundConfigDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsOptional()
  inboundsConfig?: InboundConfigDto[];
}
