import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, MinLength, IsIn, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRagSourceDto {
  @IsIn(['WEBSITE', 'FACEBOOK']) kind!: 'WEBSITE' | 'FACEBOOK';
  @IsOptional() @IsString() @MaxLength(1800) url?: string;
  @IsOptional() @IsString() @MaxLength(100) facebookPageId?: string;
}
export class ToggleRagSourceDto {
  @IsBoolean() enabled!: boolean;
}

export class CreateRagKbDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateRagKbDto {
  @IsOptional()
  @IsString()
  description?: string;
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
  @IsOptional()
  @IsString()
  name?: string;
}

export class ImportRagKbTextDto {
  @IsString()
  @MinLength(1)
  content!: string;

  @IsString()
  @MinLength(1)
  title!: string;
}

export class ImportRagKbUrlDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  @MinLength(1)
  url!: string;
}

export class RagKbSearchDto {
  @IsOptional()
  @IsString()
  knowledgeBaseId?: string;

  @IsString()
  @MinLength(1)
  query!: string;
}

export class ConnectSharedKnowledgeDto {
  @IsString()
  @MinLength(1)
  knowledgeBaseId!: string;

  @IsOptional()
  @IsBoolean()
  zaloAutoReply?: boolean;
}

export class ConnectKnowledgeZaloOaDto {
  @IsOptional()
  @IsString()
  botId?: string | null;
}

export class UpdateRagDocumentDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  content!: string;
}
