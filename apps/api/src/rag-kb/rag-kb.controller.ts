import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { createUploadMulterOptions } from '../common/uploads/upload-policy';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { RagKbService } from './rag-kb.service';
import { RagSourceService } from './rag-source.service';
import { CreateRagSourceDto, ToggleRagSourceDto } from './dto/rag-kb.dto';
import {
  ConnectKnowledgeZaloOaDto,
  ConnectSharedKnowledgeDto,
  CreateRagKbDto,
  ImportRagKbTextDto,
  ImportRagKbUrlDto,
  RagKbSearchDto,
  UpdateRagDocumentDto,
  UpdateRagKbDto,
} from './dto/rag-kb.dto';

@Controller('rag-kb')
@UseGuards(JwtAuthGuard, TenantGuard)
export class RagKbController {
  constructor(private readonly service: RagKbService, private readonly sources: RagSourceService) {}

  @Get('facebook-pages')
  facebookPages(@CurrentUser() user: AuthUser) { return this.sources.pages(user.organizationId); }

  @Get(':id/export.md')
  async exportMarkdown(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const file = await this.service.exportMarkdown(user.organizationId, id);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(file.body);
  }

  @Get(':id/sources')
  listSources(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.sources.list(user.organizationId, id); }

  @Post(':id/sources')
  createSource(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateRagSourceDto) { return this.sources.create(user.organizationId, id, dto); }

  @Post(':id/sources/:sourceId/sync')
  syncSource(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('sourceId') sourceId: string) { return this.sources.sync(user.organizationId, id, sourceId); }

  @Patch(':id/sources/:sourceId')
  toggleSource(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('sourceId') sourceId: string, @Body() dto: ToggleRagSourceDto) { return this.sources.toggle(user.organizationId, id, sourceId, dto.enabled); }

  @Delete(':id/sources/:sourceId')
  removeSource(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('sourceId') sourceId: string) { return this.sources.remove(user.organizationId, id, sourceId); }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.organizationId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRagKbDto) {
    return this.service.create(user.organizationId, dto);
  }

  @Post('search')
  search(@CurrentUser() user: AuthUser, @Body() dto: RagKbSearchDto) {
    return this.service.search(user.organizationId, dto);
  }

  @Get('chatbots')
  listChatbots(@CurrentUser() user: AuthUser) {
    return this.service.listChatbotsForKnowledge(user.organizationId);
  }

  @Get('zalo-oas')
  listZaloOas(@CurrentUser() user: AuthUser) {
    return this.service.listZaloOasForKnowledge(user.organizationId);
  }

  @Patch('chatbots/:botId')
  connectChatbot(
    @CurrentUser() user: AuthUser,
    @Param('botId') botId: string,
    @Body() dto: ConnectSharedKnowledgeDto,
  ) {
    return this.service.connectBotKnowledge(user.organizationId, botId, dto);
  }

  @Post('chatbots/:botId/consolidate')
  consolidateChatbot(@CurrentUser() user: AuthUser, @Param('botId') botId: string) {
    return this.service.consolidateBotKnowledge(user.organizationId, botId);
  }

  @Patch('zalo-oas/:connectionId')
  connectZaloOa(
    @CurrentUser() user: AuthUser,
    @Param('connectionId') connectionId: string,
    @Body() dto: ConnectKnowledgeZaloOaDto,
  ) {
    return this.service.connectZaloOaBot(
      user.organizationId,
      connectionId,
      dto.botId ?? null,
    );
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.get(user.organizationId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateRagKbDto,
  ) {
    return this.service.update(user.organizationId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user.organizationId, id);
  }

  @Post(':id/reindex')
  reindex(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.reindex(user.organizationId, id);
  }

  @Post(':id/import/text')
  importText(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ImportRagKbTextDto,
  ) {
    return this.service.importText(user.organizationId, id, dto);
  }

  @Post(':id/import/url')
  importUrl(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ImportRagKbUrlDto,
  ) {
    return this.service.importUrl(user.organizationId, id, dto);
  }

  @Post(':id/import/file')
  @UseInterceptors(FileInterceptor('file', createUploadMulterOptions('kb_text')))
  importFile(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile()
    file: { originalname?: string; buffer?: Buffer } | undefined,
  ) {
    return this.service.importFile(user.organizationId, id, file || {});
  }

  @Get(':id/documents/:docId')
  getDocument(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    return this.service.getDocumentDetail(user.organizationId, id, docId);
  }

  @Patch(':id/documents/:docId')
  updateDocument(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Body() dto: UpdateRagDocumentDto,
  ) {
    return this.service.updateDocument(user.organizationId, id, docId, dto);
  }

  @Get(':id/documents/:docId/download')
  async downloadDocument(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Res() res: Response,
  ) {
    const file = await this.service.downloadDocument(user.organizationId, id, docId);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.body);
  }

  @Delete(':id/documents/:docId')
  deleteDocument(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    return this.service.deleteDocument(user.organizationId, id, docId);
  }
}
