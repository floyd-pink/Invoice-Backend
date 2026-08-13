import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactModule } from './contact/contact.module';
import { InvoiceItemsModule } from './invoice_items/invoice_items.module';
import { InvoiceItemsService } from './invoice_items/invoice_items.service';
import { InvoiceItemsController } from './invoice_items/invoice_items.controller';
import { AuthModule } from './auth/auth.module';
import { BusinessModule } from './bussiness/bussiness.module';
import { CustomersModule } from './customers/customers.module';
import { BusinessCustomerModule } from './business-customer/business-customer.module';
import { PaymentsModule } from './payments/payments.module';
import { PlansModule } from './plans/plans.module';
import { GuardsModule } from './common/guards/guards.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        ssl: {
          rejectUnauthorized: false,
        },
        extra: {
          max: 10,
          connectionTimeoutMillis: 10000,
        },
        synchronize: true,
      }),
    }),
    ContactModule,
    InvoiceItemsModule,
    AuthModule,
    BusinessModule,
    CustomersModule,
    BusinessCustomerModule,
    PaymentsModule,
    PlansModule,
    GuardsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, //making JwtAuthGuard global for all routes, no need to use in every controller
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
