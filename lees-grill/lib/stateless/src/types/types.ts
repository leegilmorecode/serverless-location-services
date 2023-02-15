export type CreateCustomerInput = {
  firstName: number;
  surname: string;
  addressLineOne: string;
  addressLineTwo?: string;
  addressLineThree?: string;
  addressLineFour?: string;
  postCode: string;
};

export type Customer = {
  id: string;
  firstName: number;
  surname: string;
  addressLineOne: string;
  addressLineTwo?: string;
  addressLineThree?: string;
  addressLineFour?: string;
  postCode: string;
  longitude: number;
  latitude: number;
  region?: string;
  country?: string;
};

export type CreateOrderInput = {
  productId: string;
};

export type Order = {
  id: string;
  customerId: string;
  productId: string;
  distance: number;
  distanceUnit: string;
  durationInMinutes: number;
};
