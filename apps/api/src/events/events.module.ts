import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsGateway } from './events.gateway';
import { RealtimeBridgeService } from './realtime-bridge.service';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [EventsGateway, RealtimeBridgeService],
  exports: [EventsGateway, RealtimeBridgeService],
})
export class EventsModule {}
