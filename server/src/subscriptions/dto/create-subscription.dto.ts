import { IsString, IsArray, ValidateNested, IsOptional, Min, Max, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';

export class InboundConfigDto {
  @IsString()
  type: string;

  @IsOptional()
  port?: number | 'random';

  @IsString()
  @IsOptional()
  sni?: string | 'random';

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