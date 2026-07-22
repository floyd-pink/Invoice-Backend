import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppService } from './app.service';
import { ContactModule } from './contact/contact.module';
import { InvoiceItemsModule } from './invoice_items/invoice_items.module';
import { InvoiceItemsService } from './invoice_items/invoice_items.service';
import { InvoiceItemsController } from './invoice_items/invoice_items.controller';
import { AuthModule } from './auth/auth.module';
import { BusinessModule } from './bussiness/bussiness.module';
import { CustomersModule } from './customers/customers.module';
import { BusinessCustomerModule } from './business-customer/business-customer.module';

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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
