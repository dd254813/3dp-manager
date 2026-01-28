import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Inbound } from '../../inbounds/entities/inbound.entity';

@Entity()
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  uuid: string;

  @Column({ default: true })
  isEnabled: boolean;

  @OneToMany(() => Inbound, (inbound) => inbound.subscription)
  inbounds: Inbound[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}