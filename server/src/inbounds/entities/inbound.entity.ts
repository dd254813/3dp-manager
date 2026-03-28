import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Subscription } from '../../subscriptions/entities/subscription.entity';

@Entity()
export class Inbound {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  xuiId: number;

  @Column()
  port: number;

  @Column()
  protocol: string;

  @Column({ nullable: true })
  remark: string;

  @Column({ type: 'text', nullable: true })
  link: string;

  @ManyToOne(() => Subscription, (sub) => sub.inbounds, { onDelete: 'CASCADE' })
  subscription: Subscription;
}
